import {expect,it} from 'vitest';
import {formatCurrency} from './formatters';
it('formats SSR currency independently of the server or browser default locale',()=>{
 expect(formatCurrency(4.57,'$')).toBe('$4,57');
 expect(formatCurrency(12345.67,'EUR ')).toBe('EUR 12.345,67');
 expect(formatCurrency(0,'$')).toBe('$0');
 expect(formatCurrency(null)).toBe('—');
});
