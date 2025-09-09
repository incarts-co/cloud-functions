/**
 * @fileoverview QR Code Integration Implementation Plan
 * @description Detailed plan for integrating QR code tracking functionality into generateLinkHttp function
 * @module cloud-functions/generate-link-http
 * @related functions/src/generateLink.ts, docs/features/qr-code-integration.md
 */

# QR Code Integration Implementation Plan

## Executive Summary
This document outlines the implementation plan for adding QR code tracking capabilities to the `generateLinkHttp` cloud function. The integration will create a separate `qrCodes` collection in Firestore to enable individual QR code tracking while maintaining full backward compatibility with existing links.

## Current State Analysis

### Existing Implementation
- **Location**: `/functions/src/generateLink.ts`
- **Current QR Generation**: Lines 772-780 generate QR codes via `generateQrCode()` function
- **Storage**: QR codes are stored directly in the `links` collection (line 796, 812)
- **Fields Used**: 
  - `linkqrcodeimgurl` (line 796)
  - `qrCode` (line 812)
- **Response**: Returns `qrCodeUrl` in the response (line 897)

### Key Components
1. **QR Code Generator API**: `https://us-central1-incarts.cloudfunctions.net/generateQRCode`
2. **Document Creation**: Lines 792-879 build the link document
3. **Firestore Write**: Line 882 creates the document via `createLinkDocument()`

## Implementation Strategy

### Phase 1: Foundation Setup

#### 1.1 Create Helper Function
Add a new helper function after line 394 (after `createLinkDocument` function):

```typescript
/**
 * Create a default QR code record in the qrCodes collection
 * @function
 * @param {Object} params - QR code creation parameters
 * @param {string} params.linkId - The parent link document ID
 * @param {string} params.shortId - The shortened URL identifier
 * @param {string} params.qrCodeUrl - The generated QR code image URL
 * @param {string} params.projectId - The project identifier
 * @param {string} params.userId - The user creating the QR code
 * @returns {Promise<Object>} Result object with success status and qrCodeId
 */
async function createDefaultQRRecord(params: {
  linkId: string;
  shortId: string;
  qrCodeUrl: string;
  projectId: string;
  userId: string;
}): Promise<{ success: boolean; qrCodeId?: string; error?: string }> {
  try {
    // Generate the QR code document ID first (synchronous - no await needed)
    const qrRef = db.collection('qrCodes').doc();
    const qrCodeId = qrRef.id;
    
    const qrRecord = {
      linkId: params.linkId,
      identifier: 'default',
      name: 'Default QR Code',
      shortId: params.shortId,
      qrCodeUrl: params.qrCodeUrl,
      accessUrl: `https://in2carts.com/qr/${qrCodeId}`,
      createdAt: new Date(),  // Using JavaScript Date to match existing pattern (line 800)
      createdBy: params.userId,
      projectId: params.projectId,
      isDefault: true,
      clickCount: 0
    };
    
    // Set the document with the generated ID
    await qrRef.set(qrRecord);
    
    // Update the parent link document with qrCodeCount
    await db.collection('links').doc(params.linkId).update({
      qrCodeCount: 1
    });
    
    logger.info('Created default QR record', {
      qrCodeId,
      linkId: params.linkId,
      shortId: params.shortId
    });
    
    return {
      success: true,
      qrCodeId
    };
  } catch (error: any) {
    logger.error('Error creating QR record:', error);
    return {
      success: false,
      error: error.message || 'Failed to create QR record'
    };
  }
}
```

#### 1.2 Import Requirements
No additional imports required - the function uses JavaScript Date objects (matching the existing pattern) which are automatically converted to Firestore Timestamps by the SDK.

### Phase 2: Integration Points

#### 2.1 Integrate QR Record Creation
After successful link document creation (after line 890), add:

```typescript
// Create default QR record in qrCodes collection
if (linkDocId && qrResult.publicUrl && shortenResult.shortId) {
  const qrRecordResult = await createDefaultQRRecord({
    linkId: linkDocId,
    shortId: shortenResult.shortId,
    qrCodeUrl: qrResult.publicUrl,
    projectId: data.projectId,
    userId: data.userId
  });
  
  if (!qrRecordResult.success) {
    // Log the error but don't fail the entire operation
    logger.warn('Failed to create QR record, continuing with link creation', {
      error: qrRecordResult.error,
      linkId: linkDocId
    });
  }
}
```

### Phase 3: Backward Compatibility Measures

#### 3.1 Existing Links
- **No Changes Required**: Existing links will continue to function normally
- **QR Code Access**: The `qrCode` field in links collection remains unchanged
- **Migration Strategy**: Optional - create a separate migration script if needed

#### 3.2 Response Structure
- **No Changes**: The API response remains identical
- **Fields Preserved**: 
  - `shortLink`
  - `shortId`
  - `qrCodeUrl`
  - `linkDocId`

#### 3.3 Database Schema
- **Links Collection**: No schema changes, only adds optional `qrCodeCount` field
- **New Collection**: `qrCodes` collection is additive, doesn't affect existing functionality

### Phase 4: Error Handling

#### 4.1 Graceful Degradation
- If QR record creation fails, the link creation continues
- Errors are logged but don't block the main operation
- Users receive their shortened link regardless

#### 4.2 Logging Strategy
```typescript
// Success logging
logger.info('QR record created successfully', { qrCodeId, linkId });

// Warning for non-critical failures
logger.warn('QR record creation failed, link still created', { error });

// Error for critical issues
logger.error('Unexpected error in QR integration', { error, stack });
```

### Phase 5: Testing Strategy

#### 5.1 Unit Tests
1. Test `createDefaultQRRecord` function independently
2. Mock Firestore operations
3. Verify error handling

#### 5.2 Integration Tests
1. Create link with QR code integration
2. Verify both collections are updated
3. Test failure scenarios

#### 5.3 Backward Compatibility Tests
1. Ensure existing API contracts are maintained
2. Verify response structure unchanged
3. Test with existing client applications

### Phase 6: Deployment Plan

#### 6.1 Pre-deployment
1. Create `qrCodes` collection in Firestore (if not exists)
2. Set up appropriate indexes
3. Configure security rules

#### 6.2 Deployment Steps
1. Deploy updated function to staging environment
2. Run integration tests
3. Monitor logs for errors
4. Deploy to production during low-traffic period

#### 6.3 Rollback Plan
1. Function can be rolled back immediately
2. No data migration required
3. QR records can be cleaned up if needed

## Implementation Checklist

### Code Changes
- [ ] Add `createDefaultQRRecord` helper function
- [ ] Integrate QR record creation after link creation
- [ ] Add appropriate logging
- [ ] Update error handling

### Infrastructure
- [ ] Create `qrCodes` collection in Firestore
- [ ] Configure collection indexes
- [ ] Update security rules
- [ ] Set up monitoring alerts

### Testing
- [ ] Write unit tests for new function
- [ ] Create integration test suite
- [ ] Test backward compatibility
- [ ] Performance testing with load

### Documentation
- [ ] Update API documentation
- [ ] Document new collection schema
- [ ] Create migration guide (if needed)
- [ ] Update operational runbooks

### Deployment
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Deploy to production
- [ ] Post-deployment verification

## Risk Assessment

### Low Risk
- **Backward Compatibility**: No breaking changes to existing functionality
- **Data Integrity**: Original link data remains unchanged
- **Performance**: Minimal impact, one additional write operation

### Mitigation Strategies
- **Graceful Degradation**: QR record failures don't block link creation
- **Comprehensive Logging**: All operations are logged for debugging
- **Staged Rollout**: Deploy to staging first for validation

## Success Metrics

### Technical Metrics
- Zero increase in link generation failure rate
- QR record creation success rate > 99%
- No increase in average response time > 100ms

### Business Metrics
- All new links have associated QR records
- QR tracking data available for analytics
- Support for multiple QR codes per link (future)

## Timeline

### Week 1
- Days 1-2: Implement helper function and integration
- Days 3-4: Write comprehensive tests
- Day 5: Deploy to staging

### Week 2
- Days 1-2: Staging validation and testing
- Day 3: Address any issues found
- Days 4-5: Production deployment and monitoring

## Conclusion

This implementation plan ensures a smooth integration of QR code tracking functionality while maintaining complete backward compatibility. The phased approach minimizes risk and allows for thorough testing at each stage. The design is extensible, supporting future enhancements like multiple QR codes per link.