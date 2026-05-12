import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DotsIcon, TrashIcon } from '@librechat/client';
import { TVectorStore } from '~/common';

type VectorStoreListItemProps = {
  vectorStore: TVectorStore;
  deleteVectorStore: (id: string) => void;
};

export default function VectorStoreListItem({
  vectorStore,
  deleteVectorStore,
}: VectorStoreListItemProps) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => {
        navigate('vs_id_abcdef');
      }}
      className="w-100 mt-2 flex cursor-pointer flex-row justify-around rounded-md border border-border-light bg-surface-secondary p-4 text-text-primary transition duration-300 ease-in-out hover:bg-surface-hover"
    >
      <div className="flex w-1/2 flex-col justify-around align-middle">
        <strong>{vectorStore.name}</strong>
        <p className="text-sm text-text-secondary">{vectorStore.object}</p>
      </div>
      <div className="w-2/6 text-text-secondary">
        <p>
          {vectorStore.file_counts.total} Files ({vectorStore.bytes / 1000}KB)
        </p>
        <p className="text-sm">{vectorStore.created_at.toString()}</p>
      </div>
      <div className="flex w-1/6 flex-col justify-around sm:flex-row">
        <Button className="m-0 w-full content-center bg-transparent p-0 text-text-secondary hover:bg-surface-hover sm:w-min">
          <DotsIcon className="m-0 p-0 text-text-secondary" />
        </Button>
        <Button
          className="m-0 w-full bg-transparent p-0 text-text-secondary hover:bg-surface-hover sm:w-fit"
          onClick={() => deleteVectorStore(vectorStore._id)}
        >
          <TrashIcon className="m-0 p-0" />
        </Button>
      </div>
    </div>
  );
}
