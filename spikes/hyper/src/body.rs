use crate::config::{Failure, Snapshot};
use bytes::Bytes;
use http_body_util::{BodyExt, Full, combinators::UnsyncBoxBody};
use hyper::body::{Body, Frame, Incoming, SizeHint};
use std::{
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Duration,
};
use tokio::{
    sync::OwnedSemaphorePermit,
    time::{Instant, Sleep, sleep},
};

pub type ProxyBody = UnsyncBoxBody<Bytes, Failure>;

pub fn empty() -> ProxyBody {
    Full::new(Bytes::new())
        .map_err(|never| match never {})
        .boxed_unsync()
}

// Only Hyper owns framing. This wrapper counts decoded bytes and forwards
// frames (including trailers) on demand, with an idle deadline and no queue.
pub struct Streaming {
    inner: Incoming,
    remaining: usize,
    deadline: Pin<Box<Sleep>>,
    _snapshot: Arc<Snapshot>,
    _permit: Arc<OwnedSemaphorePermit>,
}

impl Streaming {
    pub fn wrap(
        inner: Incoming,
        max: usize,
        snapshot: Arc<Snapshot>,
        permit: Arc<OwnedSemaphorePermit>,
    ) -> ProxyBody {
        Self {
            inner,
            remaining: max,
            deadline: Box::pin(sleep(Duration::from_secs(2))),
            _snapshot: snapshot,
            _permit: permit,
        }
        .boxed_unsync()
    }
}

impl Body for Streaming {
    type Data = Bytes;
    type Error = Failure;

    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Bytes>, Failure>>> {
        match Pin::new(&mut self.inner).poll_frame(cx) {
            Poll::Ready(Some(Ok(frame))) => {
                if let Some(bytes) = frame.data_ref() {
                    if bytes.len() > self.remaining {
                        return Poll::Ready(Some(Err("stream byte limit".into())));
                    }
                    self.remaining -= bytes.len();
                }
                self.deadline
                    .as_mut()
                    .reset(Instant::now() + Duration::from_secs(2));
                Poll::Ready(Some(Ok(frame)))
            }
            Poll::Ready(Some(Err(error))) => Poll::Ready(Some(Err(error.into()))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => {
                if self.deadline.as_mut().poll(cx).is_ready() {
                    Poll::Ready(Some(Err("stream idle timeout".into())))
                } else {
                    Poll::Pending
                }
            }
        }
    }

    fn is_end_stream(&self) -> bool {
        self.inner.is_end_stream()
    }
    fn size_hint(&self) -> SizeHint {
        self.inner.size_hint()
    }
}
