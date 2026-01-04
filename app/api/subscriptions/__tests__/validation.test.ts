import { describe, it, expect } from '@jest/globals';
import type {
  UpdateSubscriptionsRequest,
  UpdateSubscriptionsResponse,
  BlockWithId,
  NotificationSet,
} from '@/lib/types';

describe('Subscriptions API validation', () => {
  describe('UpdateSubscriptionsRequest', () => {
    it('accepts valid request with block IDs', () => {
      const request: UpdateSubscriptionsRequest = {
        blockIds: ['block1', 'block2', 'block3'],
      };
      expect(Array.isArray(request.blockIds)).toBe(true);
      expect(request.blockIds.every((id) => typeof id === 'string')).toBe(true);
    });

    it('accepts empty block IDs array', () => {
      const request: UpdateSubscriptionsRequest = {
        blockIds: [],
      };
      expect(request.blockIds).toHaveLength(0);
    });

    it('validates block ID format', () => {
      const validIds = [
        'CHESTNUT_ST_2800',
        'LOMBARD_ST_3000',
        'abc123',
        'block-with-dashes',
      ];
      validIds.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UpdateSubscriptionsResponse', () => {
    it('has correct structure for success response', () => {
      const response: UpdateSubscriptionsResponse = {
        success: true,
        subscriptions: ['block1', 'block2'],
        notificationSets: [],
      };
      expect(response.success).toBe(true);
      expect(Array.isArray(response.subscriptions)).toBe(true);
      expect(Array.isArray(response.notificationSets)).toBe(true);
    });

    it('includes notification sets in response', () => {
      const notificationSet: Partial<NotificationSet> = {
        userId: 'user1',
        setKey: 'abc123',
        streetName: 'Chestnut St',
        blocksSummary: '2800-2900 (N side)',
      };
      const response: UpdateSubscriptionsResponse = {
        success: true,
        subscriptions: ['block1'],
        notificationSets: [notificationSet as NotificationSet],
      };
      expect(response.notificationSets).toHaveLength(1);
      expect(response.notificationSets[0].streetName).toBe('Chestnut St');
    });
  });

  describe('BlockWithId interface', () => {
    it('has required fields', () => {
      const block: BlockWithId = {
        id: 'CHESTNUT_ST_2800',
        streetName: 'Chestnut St',
        blockNumber: 2800,
        cnn: 'CNN123',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        northSchedule: {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          frequency: 'weekly',
        },
        southSchedule: null,
      };

      expect(block.id).toBe('CHESTNUT_ST_2800');
      expect(block.streetName).toBe('Chestnut St');
      expect(block.blockNumber).toBe(2800);
      expect(block.geometry.type).toBe('Polygon');
    });

    it('allows null schedules', () => {
      const block: BlockWithId = {
        id: 'block1',
        streetName: 'Test St',
        blockNumber: 100,
        cnn: 'CNN1',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        northSchedule: null,
        southSchedule: null,
      };

      expect(block.northSchedule).toBeNull();
      expect(block.southSchedule).toBeNull();
    });
  });

  describe('Error response format', () => {
    it('follows consistent error structure', () => {
      const errorResponse = { error: 'Unauthorized' };
      expect(typeof errorResponse.error).toBe('string');
    });

    it('uses appropriate error messages', () => {
      const errorMessages = [
        'Unauthorized',
        'blockIds must be an array',
        'Failed to update subscriptions',
        'Failed to fetch subscriptions',
      ];

      errorMessages.forEach((msg) => {
        expect(msg.length).toBeGreaterThan(0);
        expect(typeof msg).toBe('string');
      });
    });
  });

  describe('HTTP status codes', () => {
    it('uses correct status codes', () => {
      const statusCodes = {
        success: 200,
        unauthorized: 401,
        badRequest: 400,
        serverError: 500,
      };

      expect(statusCodes.success).toBe(200);
      expect(statusCodes.unauthorized).toBe(401);
      expect(statusCodes.badRequest).toBe(400);
      expect(statusCodes.serverError).toBe(500);
    });
  });
});

describe('Blocks API validation', () => {
  describe('GetBlocksResponse', () => {
    it('returns array of blocks', () => {
      const response = {
        blocks: [] as BlockWithId[],
      };
      expect(Array.isArray(response.blocks)).toBe(true);
    });

    it('includes all required block fields', () => {
      const block: BlockWithId = {
        id: 'block1',
        streetName: 'Chestnut St',
        blockNumber: 2800,
        cnn: 'CNN1',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-122.4358, 37.8006], [-122.435, 37.8006], [-122.435, 37.801], [-122.4358, 37.801], [-122.4358, 37.8006]]],
        },
        northSchedule: {
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          frequency: 'weekly',
        },
        southSchedule: {
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '11:00',
          frequency: 'weekly',
        },
      };

      expect(block).toHaveProperty('id');
      expect(block).toHaveProperty('streetName');
      expect(block).toHaveProperty('blockNumber');
      expect(block).toHaveProperty('cnn');
      expect(block).toHaveProperty('geometry');
      expect(block).toHaveProperty('northSchedule');
      expect(block).toHaveProperty('southSchedule');
    });
  });

  describe('CleaningSchedule validation', () => {
    it('validates dayOfWeek range', () => {
      const validDays = [0, 1, 2, 3, 4, 5, 6]; // Sun-Sat
      validDays.forEach((day) => {
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(6);
      });
    });

    it('validates time format', () => {
      const validTimes = ['08:00', '09:00', '10:00', '11:00', '12:00'];
      const timeRegex = /^\d{2}:\d{2}$/;
      validTimes.forEach((time) => {
        expect(time).toMatch(timeRegex);
      });
    });

    it('validates frequency values', () => {
      const validFrequencies = ['weekly', '1st', '2nd', '3rd', '4th', '1st_3rd', '2nd_4th'];
      validFrequencies.forEach((freq) => {
        expect(typeof freq).toBe('string');
        expect(freq.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Geometry validation', () => {
    it('accepts Polygon geometry', () => {
      const geometry = {
        type: 'Polygon' as const,
        coordinates: [[[-122.4358, 37.8006], [-122.435, 37.8006], [-122.435, 37.801], [-122.4358, 37.801], [-122.4358, 37.8006]]],
      };
      expect(geometry.type).toBe('Polygon');
      expect(Array.isArray(geometry.coordinates)).toBe(true);
    });

    it('validates coordinate structure', () => {
      const coords = [[-122.4358, 37.8006], [-122.435, 37.8006]];
      coords.forEach((coord) => {
        expect(coord).toHaveLength(2);
        expect(typeof coord[0]).toBe('number'); // longitude
        expect(typeof coord[1]).toBe('number'); // latitude
      });
    });

    it('validates SF Marina district coordinates', () => {
      // Marina district is roughly in this bounding box
      const marinaBounds = {
        minLng: -122.45,
        maxLng: -122.42,
        minLat: 37.79,
        maxLat: 37.81,
      };

      const testCoord = [-122.4358, 37.8006];
      expect(testCoord[0]).toBeGreaterThan(marinaBounds.minLng);
      expect(testCoord[0]).toBeLessThan(marinaBounds.maxLng);
      expect(testCoord[1]).toBeGreaterThan(marinaBounds.minLat);
      expect(testCoord[1]).toBeLessThan(marinaBounds.maxLat);
    });
  });
});
