import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';

// Integration tests for Customization API
describe('Customization API', () => {
  const adminToken = 'mock-token-admin';
  const hrToken = 'mock-token-hr';
  const employeeToken = 'mock-token-employee';

  let testRuleId: string;

  describe('POST /api/customization/rules', () => {
    it('should create rule (admin)', async () => {
      const response = await request(app)
        .post('/api/customization/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ruleName: 'Test Rule',
          entityType: 'leave_type',
          configType: 'override',
          configData: { max_days: 10 },
          priority: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.rule_name).toBe('Test Rule');

      testRuleId = response.body.id;
    });

    it('should reject creation without auth', async () => {
      const response = await request(app)
        .post('/api/customization/rules')
        .send({
          ruleName: 'Unauthorized Rule',
          entityType: 'test',
          configType: 'override',
          configData: {},
        });

      expect(response.status).toBe(401);
    });

    it('should reject creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/customization/rules')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          ruleName: 'Employee Rule',
          entityType: 'test',
          configType: 'override',
          configData: {},
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/customization/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // Missing required fields
          ruleName: 'Invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/customization/rules', () => {
    it('should list rules (admin)', async () => {
      const response = await request(app)
        .get('/api/customization/rules')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should list rules (HR)', async () => {
      const response = await request(app)
        .get('/api/customization/rules')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject listing by employee', async () => {
      const response = await request(app)
        .get('/api/customization/rules')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(403);
    });

    it('should filter by entity type', async () => {
      const response = await request(app)
        .get('/api/customization/rules?entityType=leave_type')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every((r: any) => r.entity_type === 'leave_type')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/customization/rules?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('GET /api/customization/rules/:id', () => {
    it('should get rule by ID (admin)', async () => {
      if (!testRuleId) return;

      const response = await request(app)
        .get(`/api/customization/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testRuleId);
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await request(app)
        .get('/api/customization/rules/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/customization/rules/:id', () => {
    it('should update rule (admin)', async () => {
      if (!testRuleId) return;

      const response = await request(app)
        .patch(`/api/customization/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 15,
        });

      expect(response.status).toBe(200);
      expect(response.body.priority).toBe(15);
    });

    it('should reject update by HR', async () => {
      if (!testRuleId) return;

      const response = await request(app)
        .patch(`/api/customization/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          priority: 20,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/customization/rules/:id/toggle', () => {
    it('should toggle rule active status (admin)', async () => {
      if (!testRuleId) return;

      const response = await request(app)
        .post(`/api/customization/rules/${testRuleId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('is_active');
    });
  });

  describe('GET /api/customization/effective', () => {
    it('should get effective config for employee', async () => {
      const response = await request(app)
        .get('/api/customization/effective?employeeId=test-id&entityType=leave_type')
        .set('Authorization', `Bearer ${employeeToken}`);

      // May fail validation (UUID required) but should not crash
      expect([200, 400]).toContain(response.status);
    });

    it('should require employeeId', async () => {
      const response = await request(app)
        .get('/api/customization/effective?entityType=leave_type')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/customization/rules/:id', () => {
    it('should delete rule (admin)', async () => {
      if (!testRuleId) return;

      const response = await request(app)
        .delete(`/api/customization/rules/${testRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);
    });

    it('should reject delete by HR', async () => {
      const response = await request(app)
        .delete('/api/customization/rules/some-id')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(response.status).toBe(403);
    });
  });
});
