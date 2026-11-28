import vercelHandler from '../../api/process-email-outbox';
import { bridgeVercelHandler } from '../lib/bridge';

export const handler = bridgeVercelHandler(vercelHandler as never);
export default handler;
