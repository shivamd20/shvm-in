import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { serverMachine } from '@vani/server/runtime/machine';
import type { VoiceConfig } from '@shvm/vani-client/shared';

import { runAgentWithMCP } from '../../../lib/chat';
import { toHttpStream } from '@tanstack/ai';

// Mock tanstack/ai to avoid window references in vitest
vi.mock('@tanstack/ai', async (importOriginal) => {
    return {
        ...(await importOriginal()) as any,
        toHttpStream: vi.fn(),
    };
});

vi.mock('../../../lib/chat', () => ({
    runAgentWithMCP: vi.fn(),
}));

vi.mock('../../../lib/mcp-client', () => ({
    createMCPConsumer: vi.fn(),
}));

describe('Server Machine', () => {
    let mockEnv: any;
    let mockStorage: any;
    let broadcastSpy: any;
    let sendBinarySpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv = {
            AI: {
                run: vi.fn(async (_model: string, input: any) => {
                    if (input?.audio) {
                        await new Promise((r) => setTimeout(r, 10));
                        return { text: 'Hello' };
                    }
                    return { text: 'Hello' };
                }),
            }
        };
        mockStorage = {
            sql: {
                exec: vi.fn()
            }
        };
        broadcastSpy = vi.fn();
        sendBinarySpy = vi.fn();

        (toHttpStream as any).mockReturnValue(
            new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(''));
                    controller.close();
                }
            })
        );

        (runAgentWithMCP as any).mockResolvedValue({});
    });

    const createServer = () => {
        return createActor(serverMachine, {
            input: {
                env: mockEnv,
                storage: mockStorage,
                broadcast: broadcastSpy,
                sendBinary: sendBinarySpy,
                initialMessages: []
            }
        });
    };

    it('should transition to listening on START with config', () => {
        const actor = createServer();
        actor.start();

        const config: VoiceConfig = { sttModel: '@cf/openai/whisper-tiny-en' };
        actor.send({ type: 'START', config });

        expect(actor.getSnapshot().value).toBe('listening');
        expect(actor.getSnapshot().context.config).toEqual(expect.objectContaining({ sttModel: '@cf/openai/whisper-tiny-en' }));
    });

    it('should handle interruptions in thinking state', async () => {
        const actor = createServer();
        actor.start();
        actor.send({ type: 'START' });

        // Add some audio
        actor.send({ type: 'AUDIO_CHUNK', data: new ArrayBuffer(10) });

        // Stop to trigger thinking
        actor.send({ type: 'STOP' });

        expect(actor.getSnapshot().value).toBe('thinking');

        // Interrupt with START
        actor.send({ type: 'START' });

        const feedbackCalls1 = broadcastSpy.mock.calls.filter((args: any[]) => args[0].type === 'feedback');
        expect(feedbackCalls1.length).toBeGreaterThanOrEqual(1);
        expect(feedbackCalls1[0][0].message).toContain("thinking");

        expect(actor.getSnapshot().value).toBe('thinking'); // Should stay thinking

        // Interrupt with AUDIO
        actor.send({ type: 'AUDIO_CHUNK', data: new ArrayBuffer(10) });

        const feedbackCalls2 = broadcastSpy.mock.calls.filter((args: any[]) => args[0].type === 'feedback');
        expect(feedbackCalls2.length).toBeGreaterThan(feedbackCalls1.length);

        actor.stop();
    });

    it('should handle STT errors properly and transition to listening', async () => {
        const actor = createServer();
        mockEnv.AI.run.mockRejectedValueOnce(new Error('STT Service Unavailable'));

        actor.start();
        actor.send({ type: 'START' });
        actor.send({ type: 'AUDIO_CHUNK', data: new ArrayBuffer(10) });
        actor.send({ type: 'STOP' }); // triggers thinking, calls sttActor

        // wait for promise to reject
        await new Promise(r => setTimeout(r, 20));

        // on error, it goes back to listening and emits an error broadcast
        expect(actor.getSnapshot().value).toBe('listening');
        expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', reason: expect.stringContaining('STT Service Unavailable') }));
    });

    it('should handle LLM errors properly and transition to listening', async () => {
        const actor = createServer();

        (runAgentWithMCP as any).mockRejectedValueOnce(new Error('LLM Service Unavailable'));

        actor.start();
        actor.send({ type: 'START' });
        actor.send({ type: 'TEXT_MESSAGE', content: 'Say hello' }); // Bypass STT straight to speaking

        expect(actor.getSnapshot().value).toBe('speaking');

        // wait for LLM promise to reject (it's inside actor fromCallback)
        await new Promise(r => setTimeout(r, 20));

        // on error.platform.llm, it goes to listening
        expect(actor.getSnapshot().value).toBe('listening');
        expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', reason: expect.stringContaining('LLM Service Unavailable') }));
    });
});
