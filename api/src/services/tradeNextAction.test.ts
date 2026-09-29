import { describe,expect,it } from 'vitest';
import { buildTradeActions } from './tradeNextAction';

const seller='seller',buyer='buyer';
const deal=(extra:Record<string,unknown>={})=>({id:'deal',seller_organization_id:seller,buyer_organization_id:buyer,seller_name:'Supplier',buyer_name:'Buyer',payment_terms_status:'draft',payment_plan:'deposit_balance',status:'accepted',...extra} as any);

describe('role-aware trade next actions',()=>{
  it('asks the supplier to configure terms before the buyer can confirm',()=>{
    expect(buildTradeActions([], [deal()], seller)[0]).toMatchObject({kind:'configure_terms',requiresAction:true});
    expect(buildTradeActions([], [deal()], buyer)[0]).toMatchObject({kind:'waiting',requiresAction:false,title:'Offer accepted—supplier preparing payment terms'});
  });
  it('asks only the buyer to confirm proposed terms',()=>{
    expect(buildTradeActions([], [deal({payment_terms_status:'proposed'})], buyer)[0]).toMatchObject({kind:'confirm_terms',requiresAction:true});
    expect(buildTradeActions([], [deal({payment_terms_status:'proposed'})], seller)[0].requiresAction).toBe(false);
  });
  it('separates buyer payment submission from seller verification',()=>{
    const due=deal({payment_terms_status:'agreed',installment_status:'due',amount_due:200,currency:'EUR'});
    expect(buildTradeActions([], [due], buyer)[0].kind).toBe('payment');
    const submitted=deal({payment_terms_status:'agreed',installment_status:'payment_submitted'});
    expect(buildTradeActions([], [submitted], seller)[0].kind).toBe('payment_verification');
  });
  it('puts a pending offer on the seller action list and buyer waiting list',()=>{
    const offer={id:'offer',status:'pending',seller_organization_id:seller,buyer_organization_id:buyer};
    expect(buildTradeActions([offer],[],seller)[0]).toMatchObject({kind:'offer_decision',requiresAction:true});
    expect(buildTradeActions([offer],[],buyer)[0]).toMatchObject({kind:'offer_waiting',requiresAction:false});
  });
});
