/** debtKBReview — authorized promotion of AI and BOB proposals into live KB.
 * The legacy Debt Coach uses custom sessions, not Base44 platform login.
 * All reviews happen server-side after verifying session + manager role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
const err=(message:string,status=400)=>Response.json({error:message},{status});
const str=(v:any,max=12000)=>String(v??'').trim().slice(0,max);
const rows=(v:any)=>Array.isArray(v)?v:v?.items||[];
const categories=new Set([
  'debt_agent','debt_customer','debt_faq','debt_hotpoints','debt_doc',
  'debt_web','debt_call','debt_kb','debt_qa_statements','debt_objections'
]);
const esc=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export default async function(req:Request):Promise<Response>{
  try{
    const base44=createClientFromRequest(req);
    const body=await req.json().catch(()=>({}));
    const userId=str(body.sessionUserId,100);
    const token=str(body.sessionToken,200);
    if(!userId||!token)return err('Debt Coach session required',401);
    const db=base44.asServiceRole.entities;
    const user=await db.DebtCoachUser.get(userId).catch(()=>null);
    if(!user?.isActive||user.sessionToken!==token||
       !['manager','super_manager','admin','super_admin'].includes(user.role)){
      return err('Knowledge Base manager authorization required',403);
    }
    const action=str(body.action,40);
    if(action==='list'){
      const result=await db.DebtKBProposal.filter({status:'pending_review'},'-created_date',150);
      return Response.json({items:rows(result).map((r:any)=>({
        id:r.id,question:r.question,answer:r.answer,category:r.category,tags:r.tags,
        source:r.source,createdBy:r.createdBy,created_date:r.created_date,
        status:r.status
      }))});
    }
    if(action!=='approve'&&action!=='reject')return err('Unsupported review action');
    const proposalId=str(body.proposalId,100);
    if(!proposalId)return err('Proposal ID required');
    const proposal=await db.DebtKBProposal.get(proposalId).catch(()=>null);
    if(!proposal)return err('Proposal not found',404);
    if(proposal.status!=='pending_review'){
      return Response.json({status:proposal.status,kbEntryId:proposal.kbEntryId||'',alreadyReviewed:true});
    }
    const question=str(body.question ?? proposal.question,1000);
    const answer=str(body.answer ?? proposal.answer,15000);
    const category=categories.has(str(body.category||proposal.category,60))?str(body.category||proposal.category,60):'debt_kb';
    const tags=str(body.tags??proposal.tags,500);
    let kbEntryId='';
    if(action==='approve'){
      if(!question||!answer)return err('Question and answer are required');
      // Repeat attempts must not create duplicates if prior create succeeded but
      // the final review-status write failed.
      const existingByTag=rows(await db.KnowledgeBase.filter({
        tags:{$regex:'proposal_id:'+esc(proposalId)}
      },'-created_date',3));
      if(existingByTag.length)kbEntryId=existingByTag[0].id;
      else{
        const duplicates=rows(await db.KnowledgeBase.filter({
          question:{$regex:'^'+esc(question)+'$',$options:'i'}
        },'-created_date',5)).filter((e:any)=>!e.kbName||e.kbName==='Debt Settlement');
        if(duplicates.length)return err('That question already exists in the published Debt KB. Review the existing answer instead; no change was made.',409);
        const entry=await db.KnowledgeBase.create({
          question,answer,answersJson:JSON.stringify([answer]),starredAnswerIndex:0,
          category,kbName:'Debt Settlement',source:str(proposal.source,500)||'AI proposal approved by staff',
          tags:[tags,'proposal_id:'+proposalId].filter(Boolean).join(', ')
        });
        kbEntryId=entry?.id||'';
      }
    }
    await db.DebtKBProposal.update(proposal.id,{
      status:action==='approve'?'approved':'rejected',question,answer,category,tags,
      reviewedBy:user.username||user.id,reviewedAt:new Date().toISOString(),kbEntryId
    });
    return Response.json({status:action==='approve'?'approved':'rejected',kbEntryId});
  }catch(e:any){
    console.error('[debtKBReview] failed',e?.message||e);
    return err(e?.message||'Knowledge review failed',500);
  }
}
