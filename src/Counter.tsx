import React from 'react';
import { useState } from "./hookstate-simplified";

function Counter() {
	const counter = useState(0);
	const test = React.useState(0);

	return (
		<div>
			<h1>Open React Dev Tools Components panel, click on Counter component and observe the crash in the logging console.</h1>
		</div>
	);
}

export default Counter;