import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { clientMachine } from '../machine/clientMachine';

describe('Client Machine', () => {
    it('should start in disconnected state', () => {
        const actor = createActor(clientMachine);
        actor.start();
        expect(actor.getSnapshot().value).toBe('disconnected');
    });

    it('should transition to connecting on CONNECT', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        expect(actor.getSnapshot().value).toBe('connecting');
        expect(actor.getSnapshot().context.status).toBe('connecting');
    });

    it('should transition to idle when CONNECTED', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });
        expect(actor.getSnapshot().value).toEqual({ connected: 'idle' });
        expect(actor.getSnapshot().context.status).toBe('idle');
    });

    it('should transition to listening on START_LISTENING', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });

        actor.send({ type: 'START_LISTENING' });
        expect(actor.getSnapshot().value).toBe('listening');
        expect(actor.getSnapshot().context.status).toBe('listening');
    });

    it('should transition to processing on STOP_LISTENING', () => {
        const actor = createActor(clientMachine);
        actor.start();
        // Setup state
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });
        actor.send({ type: 'START_LISTENING' });

        actor.send({ type: 'STOP_LISTENING' });
        expect(actor.getSnapshot().value).toEqual({ connected: 'processing' });
        expect(actor.getSnapshot().context.status).toBe('processing');
    });

    it('should transition logic based on server state', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });

        // Server thinking -> processing
        actor.send({ type: 'SERVER_STATE_CHANGE', status: 'thinking' });
        expect(actor.getSnapshot().value).toEqual({ connected: 'processing' });
        expect(actor.getSnapshot().context.status).toBe('processing');

        // Server idle -> idle
        actor.send({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
        expect(actor.getSnapshot().value).toEqual({ connected: 'idle' });
        expect(actor.getSnapshot().context.status).toBe('idle');
    });

    it('should handle speaking state properly', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });

        // Start playback
        actor.send({ type: 'AUDIO_PLAYBACK_START' });
        expect(actor.getSnapshot().value).toBe('speaking');
        expect(actor.getSnapshot().context.status).toBe('speaking');
        expect(actor.getSnapshot().context.isPlaying).toBe(true);

        // End playback
        actor.send({ type: 'AUDIO_PLAYBACK_END' });
        expect(actor.getSnapshot().value).toEqual({ connected: 'idle' });
        expect(actor.getSnapshot().context.status).toBe('idle');
        expect(actor.getSnapshot().context.isPlaying).toBe(false);
    });

    it('should prioritize local listening over server state', () => {
        const actor = createActor(clientMachine);
        actor.start();
        actor.send({ type: 'CONNECT' });
        actor.send({ type: 'CONNECTED' });
        actor.send({ type: 'START_LISTENING' });

        // Server says idle (e.g. late packet), but we are listening
        actor.send({ type: 'SERVER_STATE_CHANGE', status: 'idle' });
        expect(actor.getSnapshot().value).toBe('listening');
        expect(actor.getSnapshot().context.status).toBe('listening');
        expect(actor.getSnapshot().context.serverStatus).toBe('idle');
    });
});
