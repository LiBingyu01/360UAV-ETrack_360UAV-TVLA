"""Local preview with HTTP byte ranges, required for seeking in long MP4s."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import os,re
class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range=None
        path=self.translate_path(self.path)
        if os.path.isdir(path) or 'Range' not in self.headers:return super().send_head()
        try:file=open(path,'rb')
        except OSError:self.send_error(404);return None
        size=os.fstat(file.fileno()).st_size
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',self.headers['Range'].strip())
        if not match:file.close();self.send_error(400,'Invalid byte range');return None
        a,b=match.groups()
        if not a:start=max(0,size-int(b or size));end=size-1
        else:start=int(a);end=min(int(b) if b else size-1,size-1)
        if start>=size or end<start:
            file.close();self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
        self.send_response(206);self.send_header('Content-Type',self.guess_type(path));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.send_header('Last-Modified',self.date_time_string(os.fstat(file.fileno()).st_mtime));self.end_headers()
        self.byte_range=(start,end);file.seek(start);return file
    def end_headers(self):
        self.send_header('Accept-Ranges','bytes');super().end_headers()
    def copyfile(self,source,outputfile):
        try:
            if self.byte_range is None:return super().copyfile(source,outputfile)
            left=self.byte_range[1]-self.byte_range[0]+1
            while left>0:
                chunk=source.read(min(256*1024,left))
                if not chunk:break
                outputfile.write(chunk);left-=len(chunk)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
if __name__=='__main__':
    os.chdir(Path(__file__).resolve().parent)
    print('Preview: http://127.0.0.1:8771/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8771),Handler).serve_forever()
