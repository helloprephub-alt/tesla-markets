import handler from '../../api/push-notify';
import { bridgeVercelHandler } from '../lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
