import struct, unittest
from verify_archives import safe_name, machine, AuditError

class ArchiveAuditTests(unittest.TestCase):
    def test_safe_name(self):
        self.assertEqual(safe_name('root/a/b','root'),'root/a/b')
    def test_traversal(self):
        for name in ('root/../evil','/root/x','other/x','root/a\\b','root/C:x','root/\x00x'):
            with self.subTest(name=name), self.assertRaises(AuditError):
                safe_name(name,'root')
    def test_elf(self):
        for number,arch in ((62,'x64'),(183,'arm64')):
            data=bytearray(128);data[:6]=b'\x7fELF\x02\x01';struct.pack_into('<H',data,18,number)
            self.assertEqual(machine(data),('ELF',arch))
    def test_mach(self):
        for number,arch in ((0x1000007,'x64'),(0x100000c,'arm64')):
            data=b'\xcf\xfa\xed\xfe'+struct.pack('<I',number)+b'\x00'*100
            self.assertEqual(machine(data),('Mach-O',arch))
    def test_pe(self):
        for number,arch in ((0x8664,'x64'),(0xaa64,'arm64')):
            data=bytearray(128);data[:2]=b'MZ';struct.pack_into('<I',data,60,80);data[80:84]=b'PE\0\0';struct.pack_into('<H',data,84,number)
            self.assertEqual(machine(data),('PE',arch))
    def test_mock_rejected(self):
        with self.assertRaises(AuditError):machine(b'#!/bin/sh\necho atlascode-rs 0.0.0-mock')
    def test_bad_pe_rejected(self):
        data=bytearray(128);data[:2]=b'MZ';struct.pack_into('<I',data,60,1000)
        with self.assertRaises(AuditError):machine(data)
    def test_elf_wrong_class_rejected(self):
        with self.assertRaises(AuditError):machine(b'\x7fELF\x01\x01'+b'\0'*60)

if __name__=='__main__':unittest.main()
