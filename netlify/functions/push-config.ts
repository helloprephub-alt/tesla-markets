import handler from '../../api/push-config';
import { bridgeVercelHandler } from '../lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
