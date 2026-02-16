import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { serverMachine } from '@vani/server/runtime/machine';
import type { VoiceConfig } from '@shvm/vani-client/shared';

describe('Server Machine', () => {
    let mockEnv: any;
    let mockStorage: any;
    let broadcastSpy: any;
    let sendBinarySpy: any;

    beforeEach(() => {
        mockEnv = {
            AI: {
                run: vi.fn(async (_model: string, input: any) => {
                    if (input?.audio) {
                        await new Promise((r) => setTimeout(r, 10));
                        return { text: 'Hello' };
                    }

                    if (input?.stream) {
                        return new ReadableStream({
                            start(controller) {
                                controller.close();
                            }
                        });
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
});
