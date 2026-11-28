import handler from '../../api/process-email-outbox';
import { bridgeVercelHandler } from '../lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
