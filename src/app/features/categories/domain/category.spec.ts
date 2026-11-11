import { isSystemCategory } from './category';

describe('isSystemCategory', () => {
  it('reconoce las categorías con código como de sistema', () => {
    expect(isSystemCategory({ code: 'CARD_PAYMENT' })).toBe(true);
    expect(isSystemCategory({ code: null })).toBe(false);
  });
});
