import React from 'react';

export function useState() {
    React.useState(0);
    React.useEffect(() => {
        return () => {}
    });
}