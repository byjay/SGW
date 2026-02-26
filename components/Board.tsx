import React from 'react';
import { User, Post } from '../types';
import { MockServer } from '../services/mockServer';
import { Plus, MessageCircle, Heart, Clock, ArrowLeft, User as UserIcon, Megaphone, Search } from 'lucide-react';

interface BoardProps {
  currentUser: User;
  postIdToOpen?: string | null;
}

export const Board: React.FC<BoardProps> = ({ currentUser, postIdToOpen }) => {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
  
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [isNotice, setIsNotice] = React.useState(false);
  
  // Comment State
  const [commentText, setCommentText] = React.useState('');

  const fetchPosts = async () => {
    setLoading(true);
    const data = await MockServer.getPosts();
    setPosts(data);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchPosts();
  }, []);

  React.useEffect(() => {
    if (postIdToOpen && posts.length > 0) {
      const post = posts.find(p => p.id === postIdToOpen);
      if (post) {
        setSelectedPost(post);
      }
    }
  }, [postIdToOpen, posts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    await MockServer.createPost(
        currentUser, 
        newTitle, 
        newContent, 
        isNotice ? 'notice' : 'normal'
    );
    setNewTitle('');
    setNewContent('');
    setIsNotice(false);
    setIsCreating(false);
    fetchPosts();
  };

  const handleCommentSubmit = async () => {
      if(!commentText.trim() || !selectedPost) return;
      
      const newComment = await MockServer.addComment(selectedPost.id, currentUser, commentText);
      
      // Update local state to reflect new comment immediately
      const updatedPost = {
          ...selectedPost,
          comments: [...selectedPost.comments, newComment]
      };
      
      setSelectedPost(updatedPost);
      
      // Also update the posts list
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? updatedPost : p));
      
      setCommentText('');
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const notices = posts.filter(p => p.type === 'notice');
  const normalPosts = posts.filter(p => p.type !== 'notice');

  // --------------------------------------------------------------------------------
  // DETAIL VIEW
  // --------------------------------------------------------------------------------
  if (selectedPost) {
    return (
      <div className="animate-fade-in space-y-6">
        <button 
          onClick={() => setSelectedPost(null)}
          className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">목록으로 돌아가기</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            {selectedPost.type === 'notice' && (
                <span className="inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-sm mb-3">공지사항</span>
            )}
            <h1 className="text-2xl font-bold text-slate-900 mb-4">{selectedPost.title}</h1>
            
            <div className="flex items-center space-x-3 text-sm text-slate-500 pb-6 border-b border-slate-50 mb-6">
               <div className="flex items-center">
                   {selectedPost.type === 'notice' ? <Megaphone size={16} className="text-red-500 mr-2"/> : <UserIcon size={16} className="mr-2"/>}
                   <span className="font-bold text-slate-700">{selectedPost.authorName}</span>
               </div>
               <span className="text-slate-300">|</span>
               <div className="flex items-center">
                   <Clock size={14} className="mr-1"/>
                   {new Date(selectedPost.timestamp).toLocaleString()}
               </div>
               <span className="text-slate-300">|</span>
               <span>조회 123</span>
            </div>

            <div className="prose prose-slate max-w-none min-h-[200px]">
              <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
            </div>
          </div>
          
          <div className="bg-slate-50 px-8 py-4 flex items-center justify-center border-t border-slate-100">
              <button className="flex items-center space-x-2 text-slate-500 hover:text-red-500 transition-colors bg-white px-6 py-2 rounded-full border border-slate-200 shadow-sm">
                <Heart size={18} />
                <span className="font-medium">좋아요 {selectedPost.likes}</span>
              </button>
          </div>
        </div>

        {/* Comment Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <MessageCircle size={18} className="mr-2"/>
                댓글 {selectedPost.comments.length}
            </h3>
            
            {/* List of Comments */}
            <div className="space-y-4 mb-6">
                {selectedPost.comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
                    </div>
                ) : (
                    selectedPost.comments.map(comment => (
                        <div key={comment.id} className="flex space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                    {comment.authorName.charAt(0)}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm font-bold text-slate-700">{comment.authorName}</span>
                                    <span className="text-xs text-slate-400">{new Date(comment.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-slate-600">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="flex flex-col space-y-3">
                <textarea 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="댓글을 남겨보세요..." 
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-none h-24"
                />
                <div className="flex justify-end">
                    <button 
                        onClick={handleCommentSubmit}
                        disabled={!commentText.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                        등록
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // LIST VIEW
  // --------------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">사내 게시판</h2>
          <p className="text-slate-500 text-sm">공지사항 및 자유로운 소통 공간</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md flex items-center space-x-2 transition-all"
        >
          <Plus size={18} />
          <span>글쓰기</span>
        </button>
      </div>

      {isCreating && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 animate-fade-in mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">새 글 작성</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="내용을 입력하세요..."
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 outline-none h-40 resize-none"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
                <input 
                    type="checkbox" 
                    id="isNotice" 
                    checked={isNotice}
                    onChange={(e) => setIsNotice(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="isNotice" className="text-sm text-slate-700 font-medium select-none cursor-pointer">
                    공지사항으로 등록
                </label>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all"
              >
                등록
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table Structure */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 py-3 text-xs font-bold text-slate-500 text-center">
              <div className="col-span-1">번호</div>
              <div className="col-span-7 md:col-span-6 text-left px-4">제목</div>
              <div className="col-span-2">작성자</div>
              <div className="col-span-2 md:col-span-2">작성일</div>
              <div className="hidden md:block col-span-1">조회</div>
          </div>

          {loading ? (
              <div className="p-8 text-center text-slate-400">로딩중...</div>
          ) : (
            <>
                {/* Notices Section */}
                {notices.length > 0 && (
                    <div className="bg-slate-50/50 border-b border-slate-200">
                        {notices.map((post) => (
                             <div 
                                key={post.id} 
                                onClick={() => setSelectedPost(post)}
                                className="grid grid-cols-12 py-3 text-sm text-slate-700 text-center items-center hover:bg-red-50 cursor-pointer border-b border-slate-100 last:border-0"
                             >
                                <div className="col-span-1 flex justify-center">
                                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">공지</span>
                                </div>
                                <div className="col-span-7 md:col-span-6 text-left px-4 font-bold text-slate-800 truncate">
                                    {post.title}
                                    {post.comments.length > 0 && <span className="text-slate-400 text-xs ml-1">[{post.comments.length}]</span>}
                                </div>
                                <div className="col-span-2 truncate">{post.authorName}</div>
                                <div className="col-span-2 md:col-span-2 text-slate-500 text-xs">{formatDate(post.timestamp)}</div>
                                <div className="hidden md:block col-span-1 text-slate-400 text-xs">-</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Normal Posts Section */}
                {normalPosts.length === 0 ? (
                     <div className="p-12 text-center text-slate-400">게시글이 없습니다.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {normalPosts.map((post, idx) => (
                             <div 
                                key={post.id} 
                                onClick={() => setSelectedPost(post)}
                                className="grid grid-cols-12 py-3 text-sm text-slate-700 text-center items-center hover:bg-slate-50 cursor-pointer"
                             >
                                <div className="col-span-1 text-slate-400">{normalPosts.length - idx}</div>
                                <div className="col-span-7 md:col-span-6 text-left px-4 truncate hover:underline decoration-slate-400 underline-offset-2">
                                    {post.title}
                                    {post.comments.length > 0 && <span className="text-blue-500 text-xs ml-1 font-medium">[{post.comments.length}]</span>}
                                    {post.likes > 0 && <span className="text-red-500 text-xs ml-2">♥ {post.likes}</span>}
                                </div>
                                <div className="col-span-2 truncate">{post.authorName}</div>
                                <div className="col-span-2 md:col-span-2 text-slate-500 text-xs">{formatDate(post.timestamp)}</div>
                                <div className="hidden md:block col-span-1 text-slate-400 text-xs">0</div>
                            </div>
                        ))}
                    </div>
                )}
            </>
          )}
      </div>
      
      {/* Fake Pagination */}
      <div className="flex justify-center space-x-2 mt-6">
          <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50">&lt;</button>
          <button className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 text-white font-bold">1</button>
          <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50">2</button>
          <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50">3</button>
          <button className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:bg-slate-50">&gt;</button>
      </div>

    </div>
  );
};