#!/usr/bin/env python3
"""Independent portable-release audit. Reads bytes without extracting or executing them."""
from __future__ import annotations
import argparse, hashlib, json, re, stat, struct, tarfile, zipfile
from pathlib import Path, PurePosixPath
from typing import BinaryIO

VERSION='0.1.0'
UPSTREAM='ddcf1eb5513b02ca2a68964220f115da0a69a80a'
LICENSE_SHA='1ddfd99f2ee4677d05544245a3112c839a56f8b733bcbdd2cfe9c4b2998da3c2'
PLATFORMS=('darwin-arm64','darwin-x64','linux-x64-gnu','linux-arm64-gnu','win32-x64-msvc','win32-arm64-msvc')
FONT_SUFFIXES={'.woff','.woff2','.ttf','.otf','.eot'}

class AuditError(ValueError):pass

def require(condition:bool, message:str)->None:
    if not condition:raise AuditError(message)

def sha256(path:Path)->str:
    with path.open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()

def safe_name(raw:str,root:str)->str:
    require('\\' not in raw and '\x00' not in raw, f'Unsafe archive name: {raw!r}')
    path=PurePosixPath(raw)
    require(not path.is_absolute() and '..' not in path.parts and ':' not in raw, f'Unsafe archive name: {raw!r}')
    require(path.parts and path.parts[0]==root,f'Wrong top-level directory: {raw!r}')
    return str(path)

def machine(header:bytes)->tuple[str,str]:
    if header.startswith(b'\x7fELF'):
        require(header[4:6]==b'\x02\x01','Expected little-endian 64-bit ELF')
        return ('ELF',{62:'x64',183:'arm64'}.get(struct.unpack_from('<H',header,18)[0],'unknown'))
    if header.startswith(b'\xcf\xfa\xed\xfe'):
        return ('Mach-O',{0x1000007:'x64',0x100000c:'arm64'}.get(struct.unpack_from('<I',header,4)[0],'unknown'))
    if header.startswith(b'MZ'):
        offset=struct.unpack_from('<I',header,60)[0]
        require(offset+6<=len(header) and header[offset:offset+4]==b'PE\0\0','Invalid or oversized PE header')
        return ('PE',{0x8664:'x64',0xaa64:'arm64'}.get(struct.unpack_from('<H',header,offset+4)[0],'unknown'))
    raise AuditError('Not a supported native executable')

def inspect_archive(path:Path,platform:str)->dict:
    require(platform in PLATFORMS,'Unknown platform')
    windows=platform.startswith('win32-')
    ext='zip' if windows else 'tar.gz'
    root=f'atlascode-rs-{VERSION}-{platform}'
    require(path.name==root+'.'+ext,'Filename does not match version and platform')
    binary='atlascode-rs'+('.exe' if windows else '')
    runtime='atlascode-rs-bridge-bun'+('.exe' if windows else '')
    required={binary,runtime,'LICENSE','NOTICE','PROVENANCE.json','START-HERE.md','MIGRATION.md','THIRD-PARTY-NOTICES.md','package.json','agent-sdk/package.json','agent-sdk/dist/bridge.js','node_modules/@anthropic-ai/claude-agent-sdk/package.json'}
    expected_arch='arm64' if 'arm64' in platform else 'x64'
    expected_kind='PE' if windows else 'Mach-O' if platform.startswith('darwin') else 'ELF'
    names=set(); files={}; payload={}; executables={}
    wanted={'LICENSE','NOTICE','PROVENANCE.json','package.json','agent-sdk/package.json','node_modules/@anthropic-ai/claude-agent-sdk/package.json'}
    expected_sdk_platform=platform.replace('-gnu','').replace('-msvc','')
    native_package='node_modules/@anthropic-ai/claude-agent-sdk-'+expected_sdk_platform+'/package.json'
    required.add(native_package);wanted.add(native_package)
    def visit(name:str,size:int,mode:int,kind:str,reader:BinaryIO|None):
        normalized=safe_name(name,root)
        require(normalized not in names,'Duplicate archive entry: '+normalized);names.add(normalized)
        require(kind in ('directory','file'),'Archive contains a link/device/special entry: '+name)
        require(PurePosixPath(normalized).suffix.lower() not in FONT_SUFFIXES,'Font binary in release: '+name)
        if kind=='directory':return
        rel=str(PurePosixPath(normalized).relative_to(root));files[rel]={'size':size,'mode':oct(mode)}
        require(not re.search(r'(^|/)(claude-rs|claude-code-rust)(\.exe)?$',rel),'Old product executable: '+rel)
        if rel.startswith('node_modules/@anthropic-ai/claude-agent-sdk-') and rel.endswith('/package.json'):
            require(rel==native_package,'Wrong-platform SDK package: '+rel)
        if rel in wanted:
            require(size<2_000_000,'Oversized metadata: '+rel)
            payload[rel]=reader.read()
        if rel in (binary,runtime):
            require(size>500_000,'Native executable is too small; possible mock fixture')
            require(windows or mode&0o111,'Unix binary is not executable')
            first=reader.read(4096)
            kind_arch=machine(first)
            require(kind_arch==(expected_kind,expected_arch),f'Wrong native architecture in {rel}: {kind_arch}')
            digest=hashlib.sha256(first)
            while chunk:=reader.read(1<<20):digest.update(chunk)
            executables[rel]={'format':kind_arch[0],'architecture':kind_arch[1],'bytes':size,'sha256':digest.hexdigest()}
    if windows:
        with zipfile.ZipFile(path) as archive:
            for entry in archive.infolist():
                mode=entry.external_attr>>16
                kind='directory' if entry.is_dir() else 'file'
                require(not stat.S_ISLNK(mode),'ZIP contains a symlink: '+entry.filename)
                if entry.is_dir():visit(entry.filename,0,mode,kind,None)
                else:
                    with archive.open(entry) as stream:visit(entry.filename,entry.file_size,mode,kind,stream)
    else:
        with tarfile.open(path,'r|gz') as archive:
            for entry in archive:
                kind='directory' if entry.isdir() else 'file' if entry.isfile() else 'special'
                stream=archive.extractfile(entry) if entry.isfile() else None
                visit(entry.name,entry.size,entry.mode,kind,stream)
    require(required<=files.keys(),'Required files missing: '+str(sorted(required-files.keys())))
    require(hashlib.sha256(payload['LICENSE']).hexdigest()==LICENSE_SHA,'Original LICENSE changed')
    notice=payload['NOTICE'].decode()
    require(UPSTREAM in notice and 'Simon Peter Rothgang' in notice,'Missing upstream attribution')
    provenance=json.loads(payload['PROVENANCE.json'])
    require(provenance['name']=='atlascode-rs' and provenance['version']==VERSION,'Wrong product provenance')
    require(provenance['upstream']['commit']==UPSTREAM,'Wrong upstream provenance')
    require(provenance['policy']['in_app_updates'] is False,'Unsafe update policy')
    pkg=json.loads(payload['package.json'])
    require(pkg['name']=='atlascode-rs' and pkg['version']==VERSION and pkg['private'] is True,'Wrong portable package identity')
    bridge=json.loads(payload['agent-sdk/package.json'])
    require(bridge.get('private') is True and bridge.get('type')=='module','Bridge module is not private ESM')
    require(bridge.get('name','@atlascode-rs/agent-bridge')=='@atlascode-rs/agent-bridge','Wrong optional bridge identity')
    for rel in ('node_modules/@anthropic-ai/claude-agent-sdk/package.json',native_package):
        require(json.loads(payload[rel])['version']=='0.3.288','Wrong SDK version: '+rel)
    return {'platform':platform,'file':path.name,'bytes':path.stat().st_size,'sha256':sha256(path),'file_count':len(files),'executables':executables,'passed':True}

def main()->None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();results=[]
    for platform in PLATFORMS:
        extension='zip' if platform.startswith('win32') else 'tar.gz'
        results.append(inspect_archive(args.directory/f'atlascode-rs-{VERSION}-{platform}.{extension}',platform))
    report={'schema':'atlascode-rs-independent-archive-audit/v1','passed':True,'scope':'non-executing byte/layout/provenance audit; complements native CI runtime tests','archives':results}
    output=json.dumps(report,indent=2)+'\n'
    if args.output:args.output.write_text(output)
    print(output)
if __name__=='__main__':main()
