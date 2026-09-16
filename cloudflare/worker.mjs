const API_ORIGIN='https://ai-thiet-chan.vercel.app';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')){
      const upstream=new URL(url.pathname+url.search,API_ORIGIN);
      return fetch(new Request(upstream,request));
    }
    return env.ASSETS.fetch(request);
  }
};
