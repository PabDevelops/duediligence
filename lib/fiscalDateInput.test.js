import {describe,it,expect} from 'vitest';
import {parseFiscalDateInput,formatFiscalDateInput} from './fiscalDateInput';
describe('unambiguous day-first fiscal date entry',()=>{
 it.each([
  ['30/06/2026','2026-06-30'],['31/12/2025','2025-12-31'],['03/04/2026','2026-04-03'],
  ['30062026','2026-06-30'],['2026-06-30','2026-06-30'],['1/7/2025','2025-07-01'],
  ['29/02/2024','2024-02-29'],['',''],[' 30/06/2026 ','2026-06-30'],
 ])('parses %s without month/day guessing', (input,expected)=>expect(parseFiscalDateInput(input)).toBe(expected));
 it.each(['30','03','30/','30/06/','31/06/2026','29/02/2025','06/30/2026','2026-02-30','not a date'])('rejects incomplete or impossible date %s',input=>{
  expect(parseFiscalDateInput(input)).toBeNull();
 });
 it('displays stored ISO dates day-first and preserves the round trip',()=>{
  expect(formatFiscalDateInput('2026-06-30')).toBe('30/06/2026');
  expect(parseFiscalDateInput(formatFiscalDateInput('2026-06-30'))).toBe('2026-06-30');
  expect(formatFiscalDateInput(null)).toBe('');
 });
});
