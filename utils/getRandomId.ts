export default function getRandomId(length = 12, complex = false) {
	// Simple case - random hex string (original behavior)
	if (!complex) {
		const rounds = Math.ceil(length / 10);
		let fullString = '';
		for (let i = 0; i < rounds; i++) {
			fullString += Math.random().toString(16).slice(2).slice(0, 12);
		}
		return fullString.slice(0, length);
	}

	// Complex case - mix of numbers, lowercase and uppercase letters
	const charset = {
		numbers: '0123456789',
		lowercase: 'abcdefghijklmnopqrstuvwxyz',
		uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	};

	// Use all character sets for complex IDs
	const availableChars =
		charset.numbers + charset.lowercase + charset.uppercase;
	let result = '';
	const charactersLength = availableChars.length;

	// Generate the random string
	for (let i = 0; i < length; i++) {
		result += availableChars.charAt(
			Math.floor(Math.random() * charactersLength)
		);
	}

	// Ensure at least one character from each set if length permits
	if (length >= 3) {
		// Convert to array for manipulation
		const resultArray = result.split('');

		// Generate 3 unique positions
		const positions = Array.from({ length: 3 }, () =>
			Math.floor(Math.random() * length)
		);

		// Ensure one character from each set
		resultArray[positions[0]] = charset.numbers.charAt(
			Math.floor(Math.random() * charset.numbers.length)
		);
		resultArray[positions[1]] = charset.lowercase.charAt(
			Math.floor(Math.random() * charset.lowercase.length)
		);
		resultArray[positions[2]] = charset.uppercase.charAt(
			Math.floor(Math.random() * charset.uppercase.length)
		);

		// Convert back to string
		result = resultArray.join('');
	}

	return result;
}

// Example usage
console.log(getRandomId(12, false)); // Simple ID
console.log(getRandomId(6, true)); // Complex ID
