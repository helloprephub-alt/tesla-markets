import vercelHandler from '../../api/push-config';
import { bridgeVercelHandler } from '../lib/bridge';

export const handler = bridgeVercelHandler(vercelHandler as never);
export default handler;
