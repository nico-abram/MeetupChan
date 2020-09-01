module.exports.weighted_roll = function (options, weights) {
	const total_weight = weights.reduce(
		(total_weight, weight) => total_weight + weight,
		0
	);
	// We distribute the weights such that something like [1,1,2] is now [1,2,4]
	let tmp_accumulator = 0;
	weights = weights.map((el) => {
		tmp_accumulator = el + tmp_accumulator;
		return tmp_accumulator;
	});

	var rand = Math.random() * total_weight;
	return options[weights.findIndex((weight) => weight > rand)];
};

const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
module.exports.days_since_date = (date) =>
	Math.round(Math.abs((date - Date.now()) / oneDay));

module.exports.compare_no_case = function (a, b) {
	return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;
};

module.exports.pretty_date = function (date) {
	const dateTimeFormat = new Intl.DateTimeFormat('es', {
		year: 'numeric',
		month: 'numeric',
		day: '2-digit',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		timeZoneName: 'short',
		timeZone: 'America/Argentina/Buenos_Aires', //TODO: Handle timezone better somehow
	});
	const [
		{ value: month },
		,
		{ value: day },
		,
		{ value: year },
		,
		{ value: hour },
		,
		{ value: minute },
		,
		{ value: second },
		,
		{ value: timeZoneName },
	] = dateTimeFormat.formatToParts(date);
	return `${year}-${month}-${day} ${hour}:${minute} ${timeZoneName}`;
};
