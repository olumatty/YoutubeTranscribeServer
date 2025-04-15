import express from 'express';
import authRoutes from './auth';
import userRoutes from './user';

const router = express.Router();

// API prefix for api.paybeta.xyz
const API_VERSION = '/v1';
const SERVER_START_TIME = new Date().toUTCString();

// Register routes
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/user`, userRoutes);

// Health check endpoint
router.get(`/health`, (req, res) => {
	res.status(200).json({
		status: 'success',
		message: `No worries, I'm doing okay. Been up since ${SERVER_START_TIME}`,
		uptimeInSeconds: `${Math.floor(process.uptime())} secs`,
	});
});

// Welcome endpoint
router.get('/', (_req, res) => {
	res.send(
		'<h1 style="text-align: center; margin-top: 45vh; font-size: 4em;">Welcome to NodeJS API</h1>'
	);
});

export default router;
