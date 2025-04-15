import CustomError from '../utils/customError';
import requestHandler from '../utils/requestHandler';
import { updateUserProfile } from '../services/user';
import { UpdateProfileInput } from '../schemas/user';

/**
 * Get the current user's profile
 */
export const getCurrentUser = requestHandler(async (req, res) => {
	const user = req.user;

	if (!user) {
		throw CustomError.Unauthorized('Not authenticated');
	}

	// Remove sensitive data
	const { password, ...userWithoutPassword } = user;

	return {
		data: userWithoutPassword,
		message: 'User profile retrieved successfully',
	};
});

/**
 * Update the current user's profile
 */
export const updateProfile = requestHandler(async (req, res) => {
	const user = req.user;
	const updateData: UpdateProfileInput = req.body;

	if (!user) {
		throw CustomError.Unauthorized('Not authenticated');
	}

	// Update the user
	const updatedUser = await updateUserProfile(user.id, updateData);

	// Remove sensitive data
	const { password, ...userWithoutPassword } = updatedUser;

	return {
		data: userWithoutPassword,
		message: 'Profile updated successfully',
	};
});
