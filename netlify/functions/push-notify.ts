import handler from '../../api/push-notify';
import { bridgeVercelHandler } from './_lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
