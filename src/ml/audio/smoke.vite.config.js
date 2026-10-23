import {mergeConfig} from 'vite';
import base from '../../../vite.config.js';
// Development integration harness: root editor builds regenerate public HTML;
// disable HMR so they cannot interrupt training and fixture downloads.
export default mergeConfig(base,{server:{hmr:false,watch:{ignored:['**/public/**','**/dist/**']}}});
