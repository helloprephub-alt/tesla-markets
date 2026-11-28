import vercelHandler from '../../api/tesla-image';
import { bridgeVercelHandler } from '../lib/bridge';

export const handler = bridgeVercelHandler(vercelHandler as never);
export default handler;
