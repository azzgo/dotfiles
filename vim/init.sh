#!/bin/bash

CMD=$(dirname $0)

printError()
{

  echo -e "\033[0;31m[Error] $1" 1>&2

}

checkDotPathExist()
{

  readyForInit=0

  if [ -d ~/.vim ]; then
    printError "~/.vim folder exist, please remove it before init."
    readyForInit=1
  fi

  if [ -f ~/.vimrc ]; then
    printError "~/.vimrc exist, please remove it before init."
    readyForInit=1
  fi

  return $readyForInit
}

checkDotPathExist

readyForInit=$?

if [[ $readyForInit != 0 ]]; then
  exit 1
fi

echo "init..."
mkdir -p ~/.vim
cp -r $CMD/* ~/.vim
cp $CMD/vimrc ~/.vimrc
echo "init done"
