import React from 'react';

function useState() {
    React.useState(0);
    React.useEffect(() => () => {});
}

function Counter() {
	useState();
	React.useState(0);
	return <div>Open React Dev Tools Components panel,
		click on Counter component and
		observe the crash in the logging console.</div>;
}

export default Counter;