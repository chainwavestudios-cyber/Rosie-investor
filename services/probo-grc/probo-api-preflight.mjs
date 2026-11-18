/** Authenticated Probo GraphQL read-only identity and organization preflight.
 * NOTE: Probo schema must be verified against DEPLOYED pinned v0.340.0.
 * No writes to Probo; no OAuth credentials are stored in source.
 */
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
export async function checkProboIdentity({origin,bearerToken,expectedOrgId,send=fetch}) {
 if(typeof origin!=='string'||typeof bearerToken!=='string'||bearerToken.length<24||
    !ID.test(expectedOrgId)) throw Error('missing_probo_auth_configuration');
 let u;try {u=new URL(origin);}catch {throw Error('invalid_probo_origin');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')
   throw Error('invalid_probo_origin');
 const url=new URL('/api/console/v1/graphql',u);
 const request=async(query,variables={})=>{
   const response=await send(url.toString(),{
     method:'POST',redirect:'error',headers:{Authorization:'Bearer '+bearerToken,
       'Content-Type':'application/json','Accept':'application/json'},
     body:JSON.stringify({query,variables})
   });
   if(response.status!==200)throw Error('probo_api_not_authorized_or_unavailable');
   const raw=await response.text();
   if(raw.length>131072)throw Error('probo_api_response_too_large');
   let data;try {data=JSON.parse(raw);}catch {throw Error('invalid_probo_api_response');}
   if(!data||!data.data||Array.isArray(data.errors)&&data.errors.length>0)
     throw Error('probo_graphql_rejected');
   return data.data;
 };
 const identity=await request('query RosieCoreViewer { viewer { id } }');
 if(!identity.viewer||typeof identity.viewer.id!=='string')throw Error('probo_viewer_unverified');
 const organizations=await request('query RosieCoreOrganizations { organizations { nodes { id name } } }');
 if(!organizations.organizations||!Array.isArray(organizations.organizations.nodes))
   throw Error('probo_org_list_unverified');
 const match=organizations.organizations.nodes.find(o=>o.id===expectedOrgId);
 if(!match)throw Error('probo_expected_org_not_granted');
 return Object.freeze({authenticated:true,viewerId:identity.viewer.id,expectedOrgId:match.id});
}
