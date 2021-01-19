import React from 'react';
import { useState } from "./hookstate-simplified";

function Counter() {
	useState();
	React.useState(0);

	return (
		<div>
			<h1>Open React Dev Tools Components panel, click on Counter component and observe the crash in the logging console.</h1>
		</div>
	);
}

export default Counter;