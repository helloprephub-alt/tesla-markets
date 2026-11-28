import vercelHandler from '../../api/welcome-email';
import { bridgeVercelHandler } from '../lib/bridge';

export const handler = bridgeVercelHandler(vercelHandler as never);
export default handler;
