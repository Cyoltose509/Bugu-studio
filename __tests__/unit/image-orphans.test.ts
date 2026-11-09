import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({send:vi.fn(),find:vi.fn()}));
vi.mock("@/lib/auth/auth",()=>({auth:async()=>({user:{id:"admin",role:"ADMIN"}})}));
vi.mock("@/lib/db/prisma",()=>({prisma:Object.fromEntries(["user","clubMember","project","projectImage","activity","eventImage","jamSubmission","meetingTalk","meetingProposal","courseAttachment","courseClass","courseShowcaseItem","siteSetting"].map(model=>[model,{findMany:(...args:any[])=>mocks.find(model,...args)}]))}));
vi.mock("@aws-sdk/client-s3",()=>({
  S3Client:class{send=mocks.send},
  ListObjectsV2Command:class{kind="list";constructor(public input:any){}},
  DeleteObjectsCommand:class{kind="delete";constructor(public input:any){}},
  HeadObjectCommand:class{kind="head";constructor(public input:any){}},
}));
import {GET,POST} from "@/app/api/admin/r2/orphans/route";
const original="covers/v1/0123456789abcdef0123456789abcdef/original-w1000.png";
const variant="covers/v1/0123456789abcdef0123456789abcdef/w-640.webp";
const url=(key:string)=>"https://cdn.bugoostudio.com/"+key;
const request=(keys?:string[])=>new NextRequest("https://www.bugoostudio.com/api/admin/r2/orphans",keys?{method:"POST",body:JSON.stringify({keys}),headers:{"content-type":"application/json"}}:undefined);
beforeEach(()=>{
  vi.clearAllMocks();for(const key of ["R2_ACCOUNT_ID","R2_BUCKET_NAME","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY"])vi.stubEnv(key,"test");vi.stubEnv("R2_PUBLIC_URL","https://cdn.bugoostudio.com");
  mocks.find.mockResolvedValue([]);
});
describe("R2 cleanup protection",()=>{
  it("protects course and agenda references, plus descendants of existing originals",async()=>{
    const attachment="attachments/course.pdf",setting="covers/settings.png";
    mocks.find.mockImplementation(async(model:string)=>model==="meetingTalk"?[{imageUrl:url(original)}]:model==="courseAttachment"?[{url:url(attachment)}]:model==="siteSetting"?[{value:JSON.stringify({poster:{url:url(setting)}})}]:[]);
    mocks.send.mockResolvedValue({Contents:[original,variant,attachment,setting,"covers/unused.png"].map(Key=>({Key,Size:100}))});
    const result=await(await GET(request())).json();
    expect(result.orphans.map((object:any)=>object.key)).toEqual(["covers/unused.png"]);
  });
  it("finds derived files whose original is gone",async()=>{
    mocks.send.mockResolvedValue({Contents:[{Key:variant,Size:10}]});
    const result=await(await GET(request())).json();expect(result.orphans[0].key).toBe(variant);
  });
  it("refuses deletion when an original is still referenced",async()=>{
    mocks.find.mockImplementation(async(model:string)=>model==="meetingProposal"?[{imageUrl:url(original)}]:[]);
    const result=await(await POST(request([original]))).json();
    expect(result.results[0].success).toBe(false);expect(mocks.send).not.toHaveBeenCalled();
  });
  it("refuses direct deletion of a variant with a living original",async()=>{
    mocks.send.mockResolvedValue({Contents:[{Key:original}]});
    const result=await(await POST(request([variant]))).json();expect(result.results[0].success).toBe(false);
    expect(mocks.send.mock.calls.some(([command])=>command.kind==="delete")).toBe(false);
  });
  it("permits cleanup of a genuinely orphaned variant",async()=>{
    mocks.send.mockImplementation(async(command:any)=>{if(command.kind==="list")return{Contents:[]};if(command.kind==="head")throw{$metadata:{httpStatusCode:404}};return{};});
    const result=await(await POST(request([variant]))).json();expect(result.results[0].success).toBe(true);
    expect(mocks.send.mock.calls.find(([command])=>command.kind==="delete")?.[0].input.Delete.Objects).toEqual([{Key:variant}]);
  });
});
