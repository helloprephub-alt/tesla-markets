import vercelHandler from '../../api/push-notify';
import { bridgeVercelHandler } from '../lib/bridge';

export const handler = bridgeVercelHandler(vercelHandler as never);
export default handler;
