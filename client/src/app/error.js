'use client';

export default function Error({ error, reset }) {
    console.error("Next.js Error Boundary Caught:", error);

    return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ color: 'red' }}>Something went wrong!</h2>
            <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto' }}>
                {error.message}
            </pre>
            <details>
                <summary>Stack Trace</summary>
                <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto', fontSize: '12px' }}>
                    {error.stack}
                </pre>
            </details>
            <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
                Try again
            </button>
        </div>
    );
}
