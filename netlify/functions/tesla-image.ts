import handler from '../../api/tesla-image';
import { bridgeVercelHandler } from './_lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
