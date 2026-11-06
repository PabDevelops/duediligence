import {computeEasyMode as originalEasy,computeDCFValue as originalDcf} from './stockScoring.js';
import {analysisData} from './financialDataPolicy.js';
export function computeEasyMode(data,hasFundamentals){return originalEasy(analysisData(data),hasFundamentals);}
export function computeDCFValue(data,rate){if(data?.financialIntegrity?.calculations?.dcf?.status==='blocked')return null;return originalDcf(analysisData(data,'dcf'),rate);}
