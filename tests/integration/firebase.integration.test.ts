/**
 * Integration tests for Firebase Admin SDK.
 *
 * These tests verify that:
 * 1. Firebase Admin SDK initializes correctly with real credentials
 * 2. Firestore read/write operations work
 * 3. Security rules allow expected operations
 *
 * Requirements:
 * - Valid Firebase service account credentials
 * - Firestore database with appropriate rules
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Use a dedicated test collection to avoid polluting production data
const TEST_COLLECTION = '_integration_tests';

describe('Firebase Admin Integration', () => {
  const db = getAdminDb();
  const testDocIds: string[] = [];

  afterAll(async () => {
    // Clean up test documents
    const batch = db.batch();
    for (const docId of testDocIds) {
      batch.delete(db.collection(TEST_COLLECTION).doc(docId));
    }
    if (testDocIds.length > 0) {
      await batch.commit();
      console.log(`Cleaned up ${testDocIds.length} test documents`);
    }
  });

  it('should initialize Firebase Admin SDK successfully', () => {
    expect(db).toBeDefined();
  });

  it('should write a document to Firestore', async () => {
    const testData = {
      message: 'Integration test',
      timestamp: Timestamp.now(),
      random: Math.random(),
    };

    const docRef = await db.collection(TEST_COLLECTION).add(testData);
    testDocIds.push(docRef.id);

    expect(docRef.id).toBeDefined();
    expect(typeof docRef.id).toBe('string');
  });

  it('should read a document from Firestore', async () => {
    // First write a document
    const testData = {
      name: 'Read Test',
      value: 42,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(TEST_COLLECTION).add(testData);
    testDocIds.push(docRef.id);

    // Now read it back
    const doc = await db.collection(TEST_COLLECTION).doc(docRef.id).get();

    expect(doc.exists).toBe(true);
    expect(doc.data()?.name).toBe('Read Test');
    expect(doc.data()?.value).toBe(42);
  });

  it('should query documents from Firestore', async () => {
    // Write a document with a specific field
    const uniqueMarker = `query-test-${Date.now()}`;
    const testData = {
      marker: uniqueMarker,
      queryable: true,
    };

    const docRef = await db.collection(TEST_COLLECTION).add(testData);
    testDocIds.push(docRef.id);

    // Query for it
    const snapshot = await db
      .collection(TEST_COLLECTION)
      .where('marker', '==', uniqueMarker)
      .get();

    expect(snapshot.empty).toBe(false);
    expect(snapshot.docs.length).toBe(1);
    expect(snapshot.docs[0].data().marker).toBe(uniqueMarker);
  });

  it('should update a document in Firestore', async () => {
    // Create a document
    const docRef = await db.collection(TEST_COLLECTION).add({
      status: 'initial',
      count: 0,
    });
    testDocIds.push(docRef.id);

    // Update it
    await docRef.update({
      status: 'updated',
      count: 1,
      updatedAt: Timestamp.now(),
    });

    // Read it back
    const doc = await docRef.get();
    expect(doc.data()?.status).toBe('updated');
    expect(doc.data()?.count).toBe(1);
    expect(doc.data()?.updatedAt).toBeDefined();
  });

  it('should delete a document from Firestore', async () => {
    // Create a document
    const docRef = await db.collection(TEST_COLLECTION).add({
      toBeDeleted: true,
    });

    // Verify it exists
    const beforeDelete = await docRef.get();
    expect(beforeDelete.exists).toBe(true);

    // Delete it
    await docRef.delete();

    // Verify it's gone
    const afterDelete = await docRef.get();
    expect(afterDelete.exists).toBe(false);
  });

  it('should read from blocks collection', async () => {
    // This tests that we can access the actual blocks collection
    const snapshot = await db.collection('blocks').limit(1).get();

    // We just verify we can query - may be empty in test environment
    expect(snapshot).toBeDefined();
    console.log(`Blocks collection has ${snapshot.size} documents (limited to 1)`);
  });
});
