import { z } from 'zod';

const invisibleControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/gu;
const emailAddress = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
const rollNumber = /\b\d{2}[a-z]{2}\d{5}\b/i;

export function cleanText(maximum, { required = false, singleLine = false } = {}) {
  return z.string().transform(value => {
    const text = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(invisibleControls, '');
    return (singleLine ? text.replace(/[\n\t]+/g, ' ') : text).trim();
  }).pipe(z.string().min(required ? 1 : 0).max(maximum)
    .refine(value => !emailAddress.test(value) && !rollNumber.test(value), {
      message: 'Remove email addresses and student roll numbers.',
    }));
}

export function optionalText(maximum) {
  return cleanText(maximum).transform(value => value || null).nullish();
}
