import BoardApp from '../../ui';
export default async function Page({params}) { const {id} = await params; return <BoardApp page="board" projectId={id} />; }
