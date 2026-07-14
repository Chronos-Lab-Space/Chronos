import { describe, expect, it } from 'vitest';
import { SupabaseAccessRequestRepository } from './SupabaseAccessRequestRepository';

describe('SupabaseAccessRequestRepository', () => {
  it('submits access requests using insert-only workflow', async () => {
    const inserted: Array<Record<string, unknown>> = [];

    const client = {
      from: (table: string) => {
        expect(table).toBe('access_requests');
        return {
          insert: (payload: Record<string, unknown>) => {
            inserted.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      },
    } as any;

    const repository = new SupabaseAccessRequestRepository(client);
    const result = await repository.submit({
      email: 'test@example.com',
      identity: 'Test Org',
      agentProject: 'Project',
      chronosMotivation: 'Motivation',
      source: 'unit-test',
    });

    expect(result).toEqual({ ok: true });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      email: 'test@example.com',
      identity: 'Test Org',
      agent_project: 'Project',
      chronos_motivation: 'Motivation',
      source: 'unit-test',
    });
  });
});
