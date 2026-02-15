
import { createFileRoute } from '@tanstack/react-router';
import { Vani } from '../vani';

export const Route = createFileRoute('/voice')({
    component: VoiceRoute,
});

function VoiceRoute() {
    return (
        <Vani
            defaultMode="full"
            onError={(err) => {
                console.group('[Voice Error]');
                console.error(err);
                if (typeof err === 'object') {
                    console.error(JSON.stringify(err, null, 2));
                }
                console.groupEnd();
            }}
        />
    );
}
