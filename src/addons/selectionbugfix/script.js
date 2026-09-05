	const events = ['pointerdown', 'pointerup'];
	events.forEach((event) => addEvent(event));

	function addEvent(event) {
		document.addEventListener(event, (e) => {
			if (!e.target.closest('.x1qjc9v5.x9f619.x78zum5.xdt5ytf.x1iyjqo2.xl56j7k')) return;
			e.preventDefault();
			e.stopPropagation();
			document.querySelector('[role="button"]:has([points="20.643 3.357 12 12 3.353 20.647"])').click();
		});
	}
