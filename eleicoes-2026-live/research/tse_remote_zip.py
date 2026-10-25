"""Read selected members from large official TSE ZIPs via HTTP byte ranges."""
import urllib.request

class RR:
    def __init__(self,url):
        self.url=url
        self.pos=0
        with urllib.request.urlopen(urllib.request.Request(url,method="HEAD"),timeout=30) as r:
            self.n=int(r.headers["Content-Length"])
        self.start=-1
        self.data=b""
    def seek(self,offset,whence=0):
        self.pos=(0 if whence==0 else self.pos if whence==1 else self.n)+offset
        if not 0<=self.pos<=self.n:raise ValueError("Invalid ZIP seek")
        return self.pos
    def tell(self):return self.pos
    def seekable(self):return True
    def read(self,n=-1):
        if n<0:n=self.n-self.pos
        if n<=0 or self.pos>=self.n:return b""
        end=min(self.n,self.pos+n)
        chunks=[]
        while self.pos<end:
            if not self.start<=self.pos<self.start+len(self.data):
                begin=self.pos;stop=min(self.n,begin+2*1024*1024)
                req=urllib.request.Request(self.url,headers={"Range":f"bytes={begin}-{stop-1}"})
                with urllib.request.urlopen(req,timeout=75) as r:
                    if r.status!=206:raise RuntimeError("Source ignored byte range")
                    part=r.read()
                if len(part)!=stop-begin:raise RuntimeError("Truncated official ZIP")
                self.start=begin;self.data=part
            k=min(end-self.pos,self.start+len(self.data)-self.pos)
            chunks.append(self.data[self.pos-self.start:self.pos-self.start+k]);self.pos+=k
        return b"".join(chunks)
