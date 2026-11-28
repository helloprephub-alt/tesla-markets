import handler from '../../api/welcome-email';
import { bridgeVercelHandler } from './_lib/bridge';

export const handlerNetlify = bridgeVercelHandler(handler as never);
export default handlerNetlify;
