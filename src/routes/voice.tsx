
import { createFileRoute } from '@tanstack/react-router';
import React, { Suspense, useState, useEffect } from 'react';

const Vani = React.lazy(() => import('../vani').then(m => ({ default: m.Vani })));

export const Route = createFileRoute('/voice')({
    component: VoiceRoute,
});

function VoiceRoute() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Voice Assistant...</div>;
    }

    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Voice Assistant...</div>}>
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
        </Suspense>
    );
}
