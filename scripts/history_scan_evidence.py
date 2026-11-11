"""Fail closed when a Gitleaks history run did not inspect real commits."""
import re
import sys


ANSI = re.compile(r'\x1b\[[0-9;]*m')


def scanned_commits(log):
    clean = ANSI.sub('', log)
    failures = [line for line in clean.splitlines()
                if re.search(r'\b(?:FATAL|ERROR|ERR)\b', line, re.IGNORECASE)
                or re.search(r'\berror=', line, re.IGNORECASE)]
    if failures:
        raise ValueError('history scanner reported an error')
    matches = re.findall(r'(?<!\d)(\d+) commits scanned\.', clean)
    if len(matches) != 1 or int(matches[0]) <= 0:
        raise ValueError('history scanner did not report a positive commit count')
    return int(matches[0])


if __name__ == '__main__':
    with open(sys.argv[1], encoding='utf-8') as stream:
        print(f'{scanned_commits(stream.read())} commits scanned')
